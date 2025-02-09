import React, { useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Text, Button, Overlay, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';

interface CreateFolderModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCreateFolder: (name: string) => void;
  currentPath: string;
}

export function CreateFolderModal({ isVisible, onClose, onCreateFolder, currentPath }: CreateFolderModalProps) {
  const { theme } = useTheme();
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!folderName.trim()) {
      setError('Please enter a folder name');
      return;
    }

    // Validate folder name (no special characters except - and _)
    if (!/^[a-zA-Z0-9-_\s]+$/.test(folderName)) {
      setError('Folder name can only contain letters, numbers, spaces, - and _');
      return;
    }

    onCreateFolder(folderName.trim());
    setFolderName('');
    setError('');
    onClose();
  };

  return (
    <Overlay
      isVisible={isVisible}
      onBackdropPress={onClose}
      overlayStyle={[
        styles.overlay,
        { backgroundColor: theme.mode === 'dark' ? theme.colors.grey0 : 'white' }
      ]}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <MaterialIcons
            name="create-new-folder"
            size={24}
            color={theme.mode === 'dark' ? 'white' : theme.colors.black}
          />
          <Text
            style={[
              styles.title,
              { color: theme.mode === 'dark' ? 'white' : theme.colors.black }
            ]}
          >
            Create New Folder
          </Text>
        </View>

        <Text
          style={[
            styles.pathText,
            { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 }
          ]}
        >
          in {currentPath === '/' ? 'root' : currentPath}
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              color: theme.mode === 'dark' ? 'white' : theme.colors.black,
              backgroundColor: theme.mode === 'dark' ? theme.colors.grey1 : theme.colors.grey5,
              borderColor: error ? theme.colors.error : 'transparent',
            },
          ]}
          value={folderName}
          onChangeText={(text) => {
            setFolderName(text);
            setError('');
          }}
          placeholder="Folder name"
          placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3}
          autoFocus
        />

        {error ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {error}
          </Text>
        ) : null}

        <View style={styles.buttons}>
          <Button
            title="Cancel"
            type="clear"
            onPress={onClose}
            titleStyle={{ color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 }}
          />
          <Button
            title="Create"
            onPress={handleCreate}
            disabled={!folderName.trim()}
          />
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  overlay: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 0,
    overflow: 'hidden',
  },
  container: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  pathText: {
    fontSize: 14,
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 2,
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 24,
  },
}); 