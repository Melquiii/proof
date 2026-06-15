import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function RegisterScreen() {
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '', city: '', country: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(key: keyof typeof form) {
    return (value: string) => setForm(f => ({ ...f, [key]: value }))
  }

  async function handleRegister() {
    const { email, password, username, displayName, city, country } = form
    if (!email || !password || !username || !displayName) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.toLowerCase().trim(), display_name: displayName.trim() },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Update profile with location if provided
    if (city || country) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({ city, country }).eq('id', user.id)
      }
    }

    setLoading(false)
  }

  const field = (label: string, key: keyof typeof form, props = {}) => (
    <View className="mb-3">
      <Text className="text-proof-muted text-xs mb-1.5 uppercase tracking-wider">{label}</Text>
      <TextInput
        className="bg-proof-card border border-proof-border rounded-xl px-4 py-3.5 text-proof-white"
        placeholderTextColor="#737373"
        value={form[key]}
        onChangeText={update(key)}
        {...props}
      />
    </View>
  )

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-proof-black"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }}>
        <Text className="text-proof-white text-3xl font-bold mb-1">Create Account</Text>
        <Text className="text-proof-muted text-sm mb-8">Your rating starts with your first match.</Text>

        {error && (
          <View className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
            <Text className="text-red-400 text-sm">{error}</Text>
          </View>
        )}

        {field('Display Name *', 'displayName', { placeholder: 'How others see you', autoCapitalize: 'words' })}
        {field('Username *', 'username', { placeholder: 'proof.gg/@you', autoCapitalize: 'none', autoCorrect: false })}
        {field('Email *', 'email', { placeholder: 'you@example.com', keyboardType: 'email-address', autoCapitalize: 'none' })}
        {field('Password *', 'password', { placeholder: '8+ characters', secureTextEntry: true })}

        <View className="h-px bg-proof-border my-2" />

        {field('City', 'city', { placeholder: 'Manila', autoCapitalize: 'words' })}
        {field('Country', 'country', { placeholder: 'Philippines', autoCapitalize: 'words' })}

        <TouchableOpacity
          className="bg-proof-white rounded-xl py-4 items-center mt-4"
          onPress={handleRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#0a0a0a" />
            : <Text className="text-proof-black font-bold text-base">Create Account</Text>
          }
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-proof-muted">Already have an account? </Text>
          <Link href="/(auth)/login">
            <Text className="text-proof-white font-semibold">Sign In</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
