import React, { useState } from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { Text, Input, Button, useTheme } from '@rneui/themed';
import { Link } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.card, isWeb && styles.webCard, { backgroundColor: theme.colors.grey0, borderColor: theme.colors.grey1 }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.grey5 }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: theme.colors.grey3 }]}>
            Sign in to continue learning languages
          </Text>
        </View>

        <View style={styles.form}>
          <style>
            {`
              input:-webkit-autofill,
              input:-webkit-autofill:hover,
              input:-webkit-autofill:focus,
              input:-webkit-autofill:active {
                -webkit-box-shadow: 0 0 0 30px #1A1A1A inset !important;
                -webkit-text-fill-color: #E5E5E5 !important;
                caret-color: #E5E5E5 !important;
                border-radius: 12px !important;
              }

              input {
                outline: none !important;
                box-shadow: none !important;
              }

              input:focus {
                outline: none !important;
                box-shadow: none !important;
              }
            `}
          </style>
          
          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={20} color={theme.colors.grey3} style={styles.inputIcon} />
            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="new-password"
              containerStyle={styles.input}
              inputContainerStyle={[
                styles.inputField,
                { 
                  borderColor: theme.colors.grey2,
                  backgroundColor: theme.colors.grey1,
                }
              ]}
              inputStyle={[
                styles.inputText,
                { 
                  color: theme.colors.grey5,
                }
              ]}
              placeholderTextColor={theme.colors.grey3}
              selectionColor={theme.colors.grey3}
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color={theme.colors.grey3} style={styles.inputIcon} />
            <Input
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              containerStyle={styles.input}
              inputContainerStyle={[
                styles.inputField,
                { 
                  borderColor: theme.colors.grey2,
                  backgroundColor: theme.colors.grey1,
                }
              ]}
              inputStyle={[
                styles.inputText,
                { 
                  color: theme.colors.grey5,
                }
              ]}
              placeholderTextColor={theme.colors.grey3}
              selectionColor={theme.colors.grey3}
              rightIcon={
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={theme.colors.grey3}
                  />
                </Pressable>
              }
            />
          </View>

          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]}>
              {error}
            </Text>
          ) : null}

          <Button
            title="Sign In"
            loading={loading}
            onPress={handleSignIn}
            containerStyle={styles.buttonContainer}
            buttonStyle={[styles.button, { backgroundColor: '#4F46E5' }]}
            titleStyle={styles.buttonText}
            loadingProps={{ color: 'white' }}
            disabledStyle={{ backgroundColor: '#4F46E5' }}
            raised={false}
          />

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.grey3 }]}>
              Don't have an account?{' '}
            </Text>
            <Link href="/sign-up" asChild>
              <Pressable>
                <Text style={[styles.link, { color: '#4F46E5' }]}>Sign Up</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    ...Platform.select({
      web: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
      },
      default: {
        elevation: 4,
      },
    }),
  },
  webCard: {
    transform: [{ translateY: -40 }],
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    paddingHorizontal: 0,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: -8,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        boxShadow: 'none',
        ':focus': {
          borderColor: '#4F46E5',
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        },
        ':active': {
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        },
      },
    }),
  },
  inputIcon: {
    marginRight: 12,
    marginLeft: 4,
  },
  inputText: {
    fontSize: 16,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  buttonContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        transition: 'background-color 0.2s ease',
        ':hover': {
          backgroundColor: '#4338CA',
        },
        ':active': {
          backgroundColor: '#3730A3',
        },
      },
    }),
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
}); 