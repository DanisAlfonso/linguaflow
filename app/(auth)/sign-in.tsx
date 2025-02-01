import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, Input, useTheme } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, error, loading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  const handleSignIn = async () => {
    try {
      const { error: signInError } = await signIn(email, password);
      if (!signInError) {
        // The navigation will be handled by the auth state change in AuthContext
        return;
      }
    } catch (err) {
      console.error('Sign in error:', err);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text h1 style={[styles.title, { color: theme.colors.primary }]}>
              Welcome Back
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.grey5 }]}>
              Sign in to continue learning languages
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              leftIcon={
                <MaterialIcons
                  name="email"
                  size={24}
                  color={theme.colors.grey3}
                  style={styles.icon}
                />
              }
              inputContainerStyle={[
                styles.input,
                { borderColor: theme.colors.grey2, backgroundColor: theme.colors.grey0 }
              ]}
            />

            <Input
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              leftIcon={
                <MaterialIcons
                  name="lock"
                  size={24}
                  color={theme.colors.grey3}
                  style={styles.icon}
                />
              }
              rightIcon={
                <MaterialIcons
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={24}
                  color={theme.colors.grey3}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              inputContainerStyle={[
                styles.input,
                { borderColor: theme.colors.grey2, backgroundColor: theme.colors.grey0 }
              ]}
            />

            {error && (
              <Text style={[styles.error, { color: theme.colors.error }]}>
                {error}
              </Text>
            )}

            <Button
              title="Sign In"
              onPress={handleSignIn}
              loading={loading}
              containerStyle={styles.buttonContainer}
              buttonStyle={[styles.button, { backgroundColor: theme.colors.primary }]}
            />

            <Button
              title="Don't have an account? Sign Up"
              type="clear"
              onPress={() => router.push('/sign-up')}
              titleStyle={[styles.linkText, { color: theme.colors.primary }]}
              containerStyle={styles.linkContainer}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 56,
    marginBottom: 5,
  },
  icon: {
    marginRight: 10,
  },
  error: {
    textAlign: 'center',
    marginBottom: 15,
  },
  buttonContainer: {
    marginTop: 10,
    width: '100%',
  },
  button: {
    height: 56,
    borderRadius: 12,
  },
  linkContainer: {
    marginTop: 20,
  },
  linkText: {
    fontSize: 16,
  },
}); 