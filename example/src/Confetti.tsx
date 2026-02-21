import { useState, useEffect } from 'react'
import { useBroadcast } from '@synnel/react'

type ConfettiData = {
  type: string
  x: number
  y: number
  color: string
  timestamp: number
}

export const Confetti = () => {
  const [items, setItems] = useState<ConfettiData[]>([])
  const { data } = useBroadcast<ConfettiData>()

  useEffect(() => {
    if (data?.type === 'confetti') {
      setItems((prev) => [...prev, data])

      // Remove after 5 seconds
      setTimeout(() => {
        setItems((prev) =>
          prev.filter((item) => item.timestamp !== data.timestamp),
        )
      }, 5000)
    }
  }, [data])

  return (
    <>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            left: `${item.x}%`,
            top: `${item.y}%`,
            width: '10px',
            height: '10px',
            backgroundColor: item.color,
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 9999,
            transition: 'all 0.5s ease-out',
            animation: 'fall 5s forwards',
          }}
        />
      ))}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0); opacity: 1; }
          100% { transform: translateY(100px) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </>
  )
}
