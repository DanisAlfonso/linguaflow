import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';

interface FolderNavigationProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function FolderNavigation({ currentPath, onNavigate }: FolderNavigationProps) {
  const { theme } = useTheme();
  const pathParts = currentPath.split('/').filter(Boolean);
  const isRoot = currentPath === '/';

  const navigateToPath = (index: number) => {
    if (index === -1) {
      onNavigate('/');
    } else {
      const newPath = '/' + pathParts.slice(0, index + 1).join('/');
      onNavigate(newPath);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.locationInfo}>
        <Text style={[styles.locationLabel, { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 }]}>
          Current location:
        </Text>
      </View>
      <View style={styles.breadcrumbs}>
        <Pressable
          style={({ pressed }) => [
            styles.breadcrumb,
            isRoot && styles.currentBreadcrumb,
            pressed && styles.breadcrumbPressed,
          ]}
          onPress={() => navigateToPath(-1)}
        >
          <MaterialIcons
            name="home"
            size={20}
            color={isRoot 
              ? (theme.mode === 'dark' ? 'white' : theme.colors.black)
              : (theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3)
            }
          />
          <Text
            style={[
              styles.breadcrumbText,
              isRoot && { color: theme.mode === 'dark' ? 'white' : theme.colors.black },
              !isRoot && { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 },
            ]}
          >
            Root
          </Text>
        </Pressable>
        {pathParts.map((part, index) => (
          <React.Fragment key={index}>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3}
            />
            <Pressable
              style={({ pressed }) => [
                styles.breadcrumb,
                index === pathParts.length - 1 && styles.currentBreadcrumb,
                pressed && styles.breadcrumbPressed,
              ]}
              onPress={() => navigateToPath(index)}
            >
              <MaterialIcons
                name="folder"
                size={20}
                color={index === pathParts.length - 1
                  ? (theme.mode === 'dark' ? 'white' : theme.colors.black)
                  : (theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3)
                }
              />
              <Text
                style={[
                  styles.breadcrumbText,
                  { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 },
                  index === pathParts.length - 1 && { 
                    color: theme.mode === 'dark' ? 'white' : theme.colors.black,
                    fontWeight: '600'
                  },
                ]}
              >
                {part}
              </Text>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  locationInfo: {
    marginBottom: 4,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  currentBreadcrumb: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  breadcrumbPressed: {
    opacity: 0.7,
  },
  breadcrumbText: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 