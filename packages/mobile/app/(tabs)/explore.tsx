import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { colors, spacing, borderRadius, shadows } from '../../src/theme';
import { setAuthToken, getAuthToken, clearAuthToken } from '../../src/api/auth-helper';

export default function SettingsScreen() {
  const [apiUrl, setApiUrl] = useState('http://localhost:8787');
  const [token, setToken] = useState('');
  const [displayedToken, setDisplayedToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load current token on mount
    loadCurrentToken();
  }, []);

  const loadCurrentToken = async () => {
    try {
      const currentToken = await getAuthToken();
      setToken(currentToken || '');
      setDisplayedToken(currentToken ? '••••••••' : '');
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading token:', error);
      setIsLoading(false);
    }
  };

  const handleSaveToken = async () => {
    if (!token.trim()) {
      alert('Please enter a valid JWT token');
      return;
    }

    try {
      await setAuthToken(token);
      setDisplayedToken('••••••••');
      alert('Token saved successfully!');
    } catch (error) {
      console.error('Error saving token:', error);
      alert('Failed to save token');
    }
  };

  const handleClearToken = async () => {
    try {
      await clearAuthToken();
      setToken('');
      setDisplayedToken('');
      alert('Token cleared');
    } catch (error) {
      console.error('Error clearing token:', error);
      alert('Failed to clear token');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textMain }}>
            Dev Settings
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm }}>
            Configure API connection for testing
          </Text>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }}>
          {/* API URL Section */}
          <View style={{ marginBottom: spacing.xl }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMain, marginBottom: spacing.sm }}>
              API Base URL
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: borderRadius.md,
                borderColor: colors.border,
                borderWidth: 1,
                paddingHorizontal: spacing.md,
                ...shadows.sm,
              }}
            >
              <TextInput
                placeholder="http://localhost:8787"
                placeholderTextColor={colors.textTertiary}
                value={apiUrl}
                onChangeText={setApiUrl}
                style={{
                  paddingVertical: spacing.md,
                  color: colors.textMain,
                  fontSize: 14,
                }}
              />
            </View>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm }}>
              For local development, use http://localhost:8787 or the IP of your dev machine
            </Text>
          </View>

          {/* JWT Token Section */}
          <View style={{ marginBottom: spacing.xl }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMain, marginBottom: spacing.sm }}>
              JWT Token
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: borderRadius.md,
                borderColor: colors.border,
                borderWidth: 1,
                paddingHorizontal: spacing.md,
                ...shadows.sm,
              }}
            >
              <TextInput
                placeholder="Paste your JWT token here..."
                placeholderTextColor={colors.textTertiary}
                value={token}
                onChangeText={setToken}
                multiline
                numberOfLines={4}
                style={{
                  paddingVertical: spacing.md,
                  color: colors.textMain,
                  fontSize: 12,
                }}
              />
            </View>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm }}>
              {token ? `Token set (${token.length} chars)` : 'No token set yet'}
            </Text>
          </View>

          {/* Info Section */}
          <View
            style={{
              backgroundColor: colors.primary + '15',
              borderLeftWidth: 4,
              borderLeftColor: colors.primary,
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              marginBottom: spacing.xl,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMain, marginBottom: spacing.sm }}>
              Test Token for Demo
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
              eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2V5LTEifQ.eyJzdWIiOiJ0ZXN0LXVzZXItMDAxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo5OTk5LyIsImF1ZCI6InRlc3QtYXVkaWVuY2UiLCJpYXQiOjE3NjkyNzg5NDksImV4cCI6MTc2OTI4MjU0OX0.p34D2JWc-1L__FnVTjiDRQiuxH45yKAjidB3_qDUEHl21tX1EqGCwrxSSIcrS61_fgw3qx0xUZqnI9iR3ZyHl2um_aBe2Sm9CJeylcYb9NTP6IUidCK7md_fF72y2bLoPBwGokTZR5qp9JgKo-RaU6vEg6BZQWMCWFZqKiFDnvHJsbAmEceHLPzersLCC8gFYs0Xs5USgDtaJXwGLCo93iu2bDTMI7mbuGxOXDozmTskJrxLuOZy51L7lCGL0mGaf5nghm2qPBDPm-BL1YiPcphlIHXBCmpst2EXK86kVw90edZeNnzUwDS2CtWI-UHQaoWE-cTx6L_JzqjMEfvsGA
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          onPress={handleClearToken}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.error + '20',
            borderWidth: 1,
            borderColor: colors.error,
          }}
        >
          <Text style={{ textAlign: 'center', color: colors.error, fontWeight: '600' }}>
            Clear Token
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSaveToken}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ textAlign: 'center', color: colors.card, fontWeight: '600' }}>
            Save Token
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
