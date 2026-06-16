import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

export default function EditProfileScreen() {
  const router = useRouter()
  const [form, setForm] = useState({ displayName: '', city: '', country: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('display_name, city, country')
        .eq('id', user.id)
        .single()
      if (data) {
        setForm({
          displayName: data.display_name ?? '',
          city: data.city ?? '',
          country: data.country ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    if (!form.displayName.trim()) {
      Alert.alert('Display name required')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: form.displayName.trim(),
        city: form.city.trim() || null,
        country: form.country.trim() || null,
      })
      .eq('id', user.id)

    setSaving(false)
    if (error) {
      Alert.alert('Error', 'Could not save changes.')
    } else {
      router.back()
    }
  }

  if (loading) return (
    <View className="flex-1 bg-proof-black items-center justify-center">
      <ActivityIndicator color="#f5f5f5" />
    </View>
  )

  const field = (label: string, key: keyof typeof form, props = {}) => (
    <View className="mb-5">
      <Text className="text-proof-muted text-xs uppercase tracking-wider mb-1.5">{label}</Text>
      <TextInput
        className="bg-proof-card border border-proof-border rounded-xl px-4 py-3.5 text-proof-white"
        placeholderTextColor="#737373"
        value={form[key]}
        onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
        {...props}
      />
    </View>
  )

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-proof-black"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 24, paddingBottom: 40 }}>
        {field('Display Name', 'displayName', { placeholder: 'How others see you', autoCapitalize: 'words' })}
        {field('City', 'city', { placeholder: 'Manila', autoCapitalize: 'words' })}
        {field('Country', 'country', { placeholder: 'Philippines', autoCapitalize: 'words' })}

        <TouchableOpacity
          className="bg-proof-white rounded-xl py-4 items-center mt-2"
          onPress={save}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#0a0a0a" />
            : <Text className="text-proof-black font-bold text-base">Save Changes</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
