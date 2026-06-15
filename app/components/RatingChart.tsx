import { View, Text } from 'react-native'
import type { RatingPoint } from '../hooks/useRatingHistory'

interface Props {
  history: RatingPoint[]
  height?: number
}

export function RatingChart({ history, height = 80 }: Props) {
  if (history.length < 2) {
    return (
      <View style={{ height }} className="items-center justify-center">
        <Text className="text-proof-muted text-xs">Need 2+ matches for chart</Text>
      </View>
    )
  }

  const ratings = history.map(h => h.rating)
  const min = Math.min(...ratings)
  const max = Math.max(...ratings)
  const range = max - min || 1

  return (
    <View style={{ height }} className="flex-row items-end gap-0.5 px-1">
      {history.map((point, i) => {
        const barHeight = Math.max(4, ((point.rating - min) / range) * (height - 16))
        const isGain = point.delta >= 0
        return (
          <View key={i} className="flex-1 items-center justify-end">
            <View
              style={{ height: barHeight }}
              className={`w-full rounded-sm ${isGain ? 'bg-proof-green/70' : 'bg-red-400/70'}`}
            />
          </View>
        )
      })}
    </View>
  )
}
