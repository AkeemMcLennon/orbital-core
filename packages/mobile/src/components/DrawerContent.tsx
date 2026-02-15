import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme';

const DRAWER_ITEMS = [
  {
    id: '1',
    icon: 'home',
    label: 'Dashboard',
    route: '(tabs)',
  },
  {
    id: '2',
    icon: 'people',
    label: 'Contacts',
    route: '(tabs)',
  },
  {
    id: '3',
    icon: 'settings',
    label: 'Settings',
    route: 'settings',
  },
];

export function DrawerContent() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: spacing.lg,
          paddingHorizontal: spacing.lg,
        }}
      >
        {/* User Profile Section */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing.xxl,
            paddingBottom: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Image
            source={{ uri: 'https://ui-avatars.com/api/?name=You&background=4F46E5&color=fff' }}
            style={{
              width: 48,
              height: 48,
              borderRadius: borderRadius.full,
              marginRight: spacing.md,
            }}
          />
          <View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.textMain,
              }}
            >
              Your Name
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textTertiary,
              }}
            >
              user@orbital.app
            </Text>
          </View>
        </View>

        {/* Navigation Items */}
        <View style={{ gap: spacing.md }}>
          {DRAWER_ITEMS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                navigation.navigate(item.route);
                navigation.closeDrawer();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
                borderRadius: borderRadius.md,
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
              }}
            >
              <Ionicons name={item.icon as any} size={20} color={colors.primary} />
              <Text
                style={{
                  marginLeft: spacing.md,
                  fontSize: 14,
                  fontWeight: '500',
                  color: colors.textMain,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Help Section */}
        <View
          style={{
            marginTop: spacing.xxl,
            paddingTop: spacing.lg,
            paddingHorizontal: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing.md,
            }}
          >
            <Ionicons name="help-circle" size={18} color={colors.textTertiary} />
            <Text
              style={{
                marginLeft: spacing.md,
                fontSize: 13,
                color: colors.textTertiary,
              }}
            >
              Help & Support
            </Text>
          </Pressable>

          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing.md,
            }}
          >
            <Ionicons name="log-out" size={18} color={colors.error} />
            <Text
              style={{
                marginLeft: spacing.md,
                fontSize: 13,
                color: colors.error,
              }}
            >
              Sign Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
