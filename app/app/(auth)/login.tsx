import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    if (!email || !password) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-proof-black"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-proof-white text-4xl font-bold mb-1">PROOF</Text>
        <Text className="text-proof-muted text-base mb-10">Every match is evidence.</Text>

        {error && (
          <View className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
            <Text className="text-red-400 text-sm">{error}</Text>
          </View>
        )}

        <TextInput
          className="bg-proof-card border border-proof-border rounded-xl px-4 py-3.5 text-proof-white mb-3"
          placeholder="Email"
          placeholderTextColor="#737373"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <TextInput
          className="bg-proof-card border border-proof-border rounded-xl px-4 py-3.5 text-proof-white mb-5"
          placeholder="Password"
          placeholderTextColor="#737373"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          className="bg-proof-white rounded-xl py-4 items-center"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#0a0a0a" />
            : <Text className="text-proof-black font-bold text-base">Sign In</Text>
          }
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-proof-muted">Don't have an account? </Text>
          <Link href="/(auth)/register">
            <Text className="text-proof-white font-semibold">Sign Up</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
