import { parseVCards, isVCardFile } from "../../src/utils/vcard";

const V3 = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:Doe;Jane;;;",
  "FN:Jane Doe",
  "ORG:Acme Inc.;Engineering",
  "TITLE:CTO",
  "TEL;TYPE=CELL:+1-555-1234",
  "TEL;TYPE=WORK,VOICE:+1-555-9999",
  "EMAIL;TYPE=WORK:jane@acme.com",
  "EMAIL;TYPE=INTERNET,HOME:jane@home.com",
  "ADR;TYPE=WORK:;;123 Main St;Springfield;IL;62704;USA",
  "NICKNAME:Janey",
  "ROLE:Engineer",
  "IMPP:xmpp:jane@im.example",
  "X-SOCIALPROFILE;TYPE=twitter:https://twitter.com/janedoe",
  "NOTE:Met at conf\\nFollow up\\, soon",
  "BDAY:1985-03-15",
  "URL:https://linkedin.com/in/janedoe",
  "PHOTO;ENCODING=b;TYPE=JPEG:QUJD",
  "END:VCARD",
].join("\r\n");

const V4 = [
  "BEGIN:VCARD",
  "VERSION:4.0",
  "FN:Bob Smith",
  "EMAIL:bob@x.com",
  "PHOTO:data:image/png;base64,AAAA",
  "END:VCARD",
].join("\r\n");

describe("parseVCards", () => {
  it("maps core fields from a v3.0 card", () => {
    const [c] = parseVCards(V3);
    expect(c).toMatchObject({
      name: "Jane Doe",
      email: "jane@acme.com",
      phone: "+1-555-1234",
      company: "Acme Inc.",
      jobTitle: "CTO",
      birthday: "1985-03-15",
      urls: ["https://linkedin.com/in/janedoe"],
    });
  });

  it("unescapes vCard text escapes in notes", () => {
    const [c] = parseVCards(V3);
    expect(c.notes).toBe("Met at conf\nFollow up, soon");
  });

  it("collects values with no column as labelled extras", () => {
    const [c] = parseVCards(V3);
    expect(c.extras).toEqual([
      { label: "Phone (work)", value: "+1-555-9999" },
      { label: "Email (home)", value: "jane@home.com" },
      {
        label: "Address (work)",
        value: "123 Main St, Springfield, IL, 62704, USA",
      },
      { label: "Nickname", value: "Janey" },
      { label: "Role", value: "Engineer" },
    ]);
  });

  it("keeps an escaped semicolon inside an address component", () => {
    // String.raw so the fixture carries a real backslash: the vCard escape
    // `\;` is a literal semicolon inside the street, not a field delimiter.
    const card = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Escaped Addr",
      String.raw`ADR;TYPE=WORK:;;Suite 1\; Building A;Springfield;IL;62704;USA`,
      "END:VCARD",
    ].join("\r\n");
    const [c] = parseVCards(card);
    expect(c.extras).toEqual([
      {
        label: "Address (work)",
        value: "Suite 1; Building A, Springfield, IL, 62704, USA",
      },
    ]);
  });

  it("omits extras for a card with a single phone and email", () => {
    const card = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Solo Person",
      "TEL:+1-555-0000",
      "EMAIL:solo@x.com",
      "END:VCARD",
    ].join("\r\n");
    const [c] = parseVCards(card);
    expect(c.extras).toBeUndefined();
  });

  it("strips the tel:/mailto: scheme from v4.0 URI values", () => {
    const card = [
      "BEGIN:VCARD",
      "VERSION:4.0",
      "FN:Uri Person",
      'TEL;VALUE=uri;TYPE="work,voice";PREF=1:tel:+1-555-0100',
      "EMAIL:mailto:uri@x.com",
      "END:VCARD",
    ].join("\r\n");
    const [c] = parseVCards(card);
    expect(c.phone).toBe("+1-555-0100");
    expect(c.email).toBe("uri@x.com");
  });

  it("extracts a v3.0 inline base64 photo with its mime", () => {
    const [c] = parseVCards(V3);
    expect(c.photoBase64).toBe("QUJD");
    expect(c.photoMimeType).toBe("image/jpeg");
    expect(c.photoUrl).toBeUndefined();
  });

  it("splits a v4.0 data: URI photo into base64 + mime", () => {
    const [c] = parseVCards(V4);
    expect(c.photoBase64).toBe("AAAA");
    expect(c.photoMimeType).toBe("image/png");
  });

  it("keeps an http photo URL as photoUrl", () => {
    const card = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Url Person",
      "PHOTO;VALUE=URI:https://example.com/p.jpg",
      "END:VCARD",
    ].join("\r\n");
    const [c] = parseVCards(card);
    expect(c.photoUrl).toBe("https://example.com/p.jpg");
    expect(c.photoBase64).toBeUndefined();
  });

  it("parses multiple cards in one file", () => {
    const cards = parseVCards(`${V3}\r\n${V4}`);
    expect(cards.map((c) => c.name)).toEqual(["Jane Doe", "Bob Smith"]);
  });

  it("composes a name from N when FN is absent", () => {
    const card = [
      "BEGIN:VCARD",
      "VERSION:2.1",
      "N:Stark;Tony;;Mr.;",
      "END:VCARD",
    ].join("\r\n");
    const [c] = parseVCards(card);
    expect(c.name).toBe("Mr. Tony Stark");
  });

  it("tolerates a leading BOM / blank line", () => {
    const cards = parseVCards(`﻿\n${V3}`);
    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe("Jane Doe");
  });

  it("parses a card with LF-only line endings", () => {
    const lf = V3.replace(/\r\n/g, "\n");
    const [c] = parseVCards(lf);
    expect(c.name).toBe("Jane Doe");
    expect(c.email).toBe("jane@acme.com");
  });

  it("returns an empty array for non-vCard input", () => {
    expect(parseVCards("not a vcard")).toEqual([]);
    expect(parseVCards("")).toEqual([]);
  });
});

describe("isVCardFile", () => {
  it("matches vCard MIME types and .vcf names", () => {
    expect(isVCardFile({ mimeType: "text/vcard" })).toBe(true);
    expect(isVCardFile({ mimeType: "text/x-vcard" })).toBe(true);
    expect(isVCardFile({ mimeType: "application/vcard" })).toBe(true);
    expect(isVCardFile({ mimeType: "text/directory" })).toBe(true);
    expect(isVCardFile({ path: "/cache/Contact.VCF" })).toBe(true);
    expect(isVCardFile({ fileName: "jane.vcf" })).toBe(true);
  });

  it("rejects non-vCard files and nullish input", () => {
    expect(isVCardFile({ mimeType: "image/jpeg", path: "/x.jpg" })).toBe(false);
    expect(isVCardFile({ mimeType: "text/plain" })).toBe(false);
    expect(isVCardFile(null)).toBe(false);
    expect(isVCardFile(undefined)).toBe(false);
  });
});
