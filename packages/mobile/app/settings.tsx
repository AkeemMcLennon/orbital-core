import React, { useState } from "react";
import {
  Alert,
  Pressable,
  Text,
  View,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { requestAccountDeletion, unwrapAsync } from "@orbital/client";
import { borderRadius, colors, spacing } from "../src/theme";
import { useAuthContext } from "../src/contexts/AuthContext";

const CONFIRM_PHRASE = "DELETE";

export default function SettingsScreen() {
  const { signOut } = useAuthContext();
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { mutate: requestDeletion, isPending } = useMutation({
    mutationFn: () => unwrapAsync(requestAccountDeletion()),
    onSuccess: () => {
      setConfirmed(true);
      setTimeout(() => {
        setModalVisible(false);
        signOut();
      }, 3000);
    },
    // Without this the modal just sits there on failure, having shown neither
    // the confirmation state nor any reason — on the one action the user most
    // needs confirmed.
    //
    // Alert rather than a toast: this fires while the confirmation Modal is
    // open, and a native Modal renders above the toast viewport — the toast
    // would be invisible underneath it.
    onError: () =>
      Alert.alert(
        "Request Failed",
        "We couldn't submit your deletion request. Please try again.",
      ),
  });

  const canConfirm = confirmText === CONFIRM_PHRASE && !isPending;

  function openModal() {
    setConfirmText("");
    setConfirmed(false);
    setModalVisible(true);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text
          style={{ fontSize: 24, fontWeight: "700", color: colors.textMain }}
        >
          Settings
        </Text>
      </View>

      {/* Settings List */}
      <View style={{ paddingTop: spacing.md }}>
        <Pressable
          onPress={() => router.push("/memory-rep-frequency")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: pressed ? colors.border : colors.bg,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: borderRadius.sm,
              backgroundColor: colors.primary + "20",
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.md,
            }}
          >
            <Ionicons name="timer-outline" size={20} color={colors.primary} />
          </View>
          <Text style={{ flex: 1, fontSize: 16, color: colors.textMain }}>
            Memory Rep Frequency
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </Pressable>

        <Pressable
          onPress={() => router.push("/developer-options")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: pressed ? colors.border : colors.bg,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: borderRadius.sm,
              backgroundColor: colors.primary + "20",
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.md,
            }}
          >
            <Ionicons
              name="settings-outline"
              size={20}
              color={colors.primary}
            />
          </View>
          <Text style={{ flex: 1, fontSize: 16, color: colors.textMain }}>
            Developer Options
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </Pressable>

        <Pressable
          onPress={() => router.push("/onboarding")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: pressed ? colors.border : colors.bg,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: borderRadius.sm,
              backgroundColor: colors.primary + "20",
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.md,
            }}
          >
            <Ionicons
              name="sparkles-outline"
              size={20}
              color={colors.primary}
            />
          </View>
          <Text style={{ flex: 1, fontSize: 16, color: colors.textMain }}>
            Replay Intro Tour
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </Pressable>
      </View>

      {/* Danger Zone */}
      <View
        style={{
          marginTop: "auto",
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xl,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: colors.error,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginBottom: spacing.sm,
          }}
        >
          Danger Zone
        </Text>
        <Pressable
          onPress={openModal}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.error + "50",
            backgroundColor: pressed ? colors.error + "10" : colors.bg,
          })}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={colors.error}
            style={{ marginRight: spacing.sm }}
          />
          <Text style={{ fontSize: 16, color: colors.error }}>
            Delete Account
          </Text>
        </Pressable>
      </View>

      {/* Confirmation Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !isPending && setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
            onPress={() => !isPending && setModalVisible(false)}
          >
            <Pressable
              onPress={(e) => e?.stopPropagation?.()}
              style={{
                backgroundColor: colors.bg,
                borderTopLeftRadius: borderRadius.xl,
                borderTopRightRadius: borderRadius.xl,
                padding: spacing.xl,
                gap: spacing.md,
              }}
            >
              {confirmed ? (
                <View
                  style={{ alignItems: "center", paddingVertical: spacing.lg }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={48}
                    color={colors.success}
                  />
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "700",
                      color: colors.textMain,
                      marginTop: spacing.md,
                      textAlign: "center",
                    }}
                  >
                    Deletion Requested
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.textSecondary,
                      textAlign: "center",
                      marginTop: spacing.sm,
                    }}
                  >
                    Your account will be deleted in 14 days. Log back in at any
                    time to cancel.
                  </Text>
                </View>
              ) : (
                <>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "700",
                      color: colors.textMain,
                    }}
                  >
                    Delete Your Account
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.textSecondary,
                      lineHeight: 20,
                    }}
                  >
                    This will permanently delete your account and all associated
                    contacts, notes, and data after{" "}
                    <Text style={{ fontWeight: "600" }}>14 days</Text>. If you
                    log back in before then, the deletion will be canceled.
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                    Type{" "}
                    <Text style={{ fontWeight: "700", color: colors.error }}>
                      {CONFIRM_PHRASE}
                    </Text>{" "}
                    to confirm:
                  </Text>
                  <TextInput
                    value={confirmText}
                    onChangeText={setConfirmText}
                    autoCapitalize="characters"
                    placeholder={CONFIRM_PHRASE}
                    placeholderTextColor={colors.textTertiary}
                    style={{
                      borderWidth: 1,
                      borderColor:
                        confirmText === CONFIRM_PHRASE
                          ? colors.error
                          : colors.border,
                      borderRadius: borderRadius.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      fontSize: 16,
                      color: colors.textMain,
                      fontFamily: "monospace",
                    }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.sm,
                      marginTop: spacing.sm,
                    }}
                  >
                    <Pressable
                      onPress={() => setModalVisible(false)}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: spacing.md,
                        borderRadius: borderRadius.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                        backgroundColor: pressed ? colors.border : colors.bg,
                      })}
                    >
                      <Text style={{ fontSize: 16, color: colors.textMain }}>
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => requestDeletion()}
                      accessibilityRole="button"
                      // The Danger Zone row behind this modal is also labelled
                      // "Delete Account".
                      accessibilityLabel="Delete my account permanently"
                      disabled={!canConfirm}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: spacing.md,
                        borderRadius: borderRadius.md,
                        alignItems: "center",
                        backgroundColor: canConfirm
                          ? pressed
                            ? colors.error + "cc"
                            : colors.error
                          : colors.error + "40",
                      })}
                    >
                      {isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text
                          style={{
                            fontSize: 16,
                            color: "#fff",
                            fontWeight: "600",
                          }}
                        >
                          Delete Account
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
