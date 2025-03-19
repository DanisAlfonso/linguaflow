import React from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';

interface NotesHeaderProps {
  currentFolder: string;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  view: 'grid' | 'list';
  onViewChange: (view: 'grid' | 'list') => void;
  onSortMenuPress: () => void;
  onCreateFolderPress: () => void;
  isOffline?: boolean;
}

export function NotesHeader({
  currentFolder,
  searchQuery,
  onSearchChange,
  view,
  onViewChange,
  onSortMenuPress,
  onCreateFolderPress,
  isOffline = false
}: NotesHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.titleContainer}>
          <Text h1 style={[styles.title, { color: theme.mode === 'dark' ? 'white' : theme.colors.black }]}>
            Notes
          </Text>
          {isOffline && (
            <View style={[
              styles.offlineIndicator, 
              { 
                backgroundColor: theme.mode === 'dark' 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(0, 0, 0, 0.05)' 
              }
            ]}>
              <MaterialIcons 
                name="cloud-off" 
                size={14} 
                color={theme.mode === 'dark' ? '#A1A1AA' : '#71717A'} 
              />
              <Text style={[
                styles.offlineText, 
                { 
                  color: theme.mode === 'dark' ? '#A1A1AA' : '#71717A' 
                }
              ]}>
                Offline
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          <Button
            type="clear"
            icon={<MaterialIcons name={view === 'grid' ? 'grid-view' : 'view-list'} size={24} color={theme.colors.primary}/>}
            onPress={() => onViewChange(view === 'grid' ? 'list' : 'grid')}
          />
          <Button
            type="clear"
            icon={<MaterialIcons name="create-new-folder" size={24} color={theme.colors.primary}/>}
            onPress={onCreateFolderPress}
          />
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={[
          styles.searchInputContainer,
          { 
            backgroundColor: theme.mode === 'dark' ? theme.colors.grey1 : theme.colors.grey5,
            borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          }
        ]}>
          <MaterialIcons 
            name="search" 
            size={20} 
            color={theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3}
          />
          <TextInput
            style={[
              styles.searchInput,
              { color: theme.mode === 'dark' ? 'white' : theme.colors.black }
            ]}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search notes and folders..."
            placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3}
          />
          {searchQuery ? (
            <Pressable
              onPress={() => onSearchChange('')}
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.clearButtonPressed
              ]}
            >
              <MaterialIcons 
                name="close" 
                size={20} 
                color={theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3}
              />
            </Pressable>
          ) : null}
        </View>
        <Button
          type="clear"
          icon={
            <MaterialIcons 
              name="sort" 
              size={24} 
              color={theme.colors.primary}
            />
          }
          onPress={onSortMenuPress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 32,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    height: 44,
    padding: 0,
  },
  clearButton: {
    padding: 4,
    borderRadius: 12,
  },
  clearButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
}); 