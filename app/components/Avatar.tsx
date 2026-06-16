import { View, Text } from 'react-native'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444']

function colorFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface Props {
  name: string
  size?: number
}

export function Avatar({ name, size = 40 }: Props) {
  const bg = colorFor(name)
  const fontSize = Math.round(size * 0.38)
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize, fontWeight: '700', letterSpacing: 0.5 }}>
        {initials(name)}
      </Text>
    </View>
  )
}
