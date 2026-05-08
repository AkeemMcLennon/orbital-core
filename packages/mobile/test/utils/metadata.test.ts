import { cleanSocialTitle } from '../../src/utils/metadata';

const LI = 'https://www.linkedin.com/in/johndoe/';
const IG = 'https://www.instagram.com/natgeo/';
const OTHER = 'https://github.com/anthropics';

describe('cleanSocialTitle', () => {
  describe('null / empty input', () => {
    it('returns null when title is null', () => {
      expect(cleanSocialTitle(null, LI)).toBeNull();
    });

    it('returns title unchanged for non-social URLs', () => {
      expect(cleanSocialTitle('Anthropic · GitHub', OTHER)).toBe('Anthropic · GitHub');
    });
  });

  describe('LinkedIn', () => {
    it('strips " | LinkedIn" suffix', () => {
      expect(cleanSocialTitle('John Doe | LinkedIn', LI)).toBe('John Doe');
    });

    it('strips job title and " | LinkedIn"', () => {
      expect(cleanSocialTitle('John Doe - Software Engineer | LinkedIn', LI)).toBe('John Doe');
    });

    it('strips longer job title with company', () => {
      expect(cleanSocialTitle('John Doe - VP Eng at Google | LinkedIn', LI)).toBe('John Doe');
    });

    it('preserves hyphenated names (no spaces around hyphen)', () => {
      expect(cleanSocialTitle('Mary-Jane Watson - Engineer | LinkedIn', LI)).toBe('Mary-Jane Watson');
    });

    it('handles em-dash separator', () => {
      expect(cleanSocialTitle('John Doe – Engineer | LinkedIn', LI)).toBe('John Doe');
    });

    it('returns title unchanged when it contains no known suffix', () => {
      expect(cleanSocialTitle('John Doe', LI)).toBe('John Doe');
    });
  });

  describe('Instagram', () => {
    it('strips (@handle) and • Instagram suffix', () => {
      expect(cleanSocialTitle('natgeo (@natgeo) • Instagram photos and videos', IG)).toBe('natgeo');
    });

    it('strips leading @ and • Instagram suffix', () => {
      expect(cleanSocialTitle('@natgeo • Instagram', IG)).toBe('natgeo');
    });

    it('strips • Instagram from display name with (@handle)', () => {
      expect(cleanSocialTitle('National Geographic (@natgeo) • Instagram photos and videos', IG)).toBe('National Geographic');
    });

    it('returns title unchanged when it contains no known suffix', () => {
      expect(cleanSocialTitle('natgeo', IG)).toBe('natgeo');
    });
  });
});
