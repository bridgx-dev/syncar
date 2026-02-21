import { useState, useEffect, useMemo } from 'react'
import { useChannel, useSynnel } from '@synnel/react'

type MouseParams = {
  id: string
  name: string
  x: number
  y: number
  lastUpdate: number
}

const COLORS = [
  '#FF5733',
  '#33FF57',
  '#3357FF',
  '#F333FF',
  '#33FFF3',
  '#F3FF33',
]

export const MouseTracker = () => {
  const { client } = useSynnel()
  const [cursors, setCursors] = useState<Record<string, MouseParams>>({})

  const myName = useMemo(() => {
    const names = [
      'Panda',
      'Tiger',
      'Eagle',
      'Shark',
      'Lion',
      'Fox',
      'Wolf',
      'Bear',
    ]
    // eslint-disable-next-line react-hooks/purity
    return `${names[Math.floor(Math.random() * names.length)]} ${Math.floor(Math.random() * 100)}`
  }, [])

  const { send } = useChannel<MouseParams>('mouse-tracker', {
    onMessage: (data) => {
      if (data.id === client?.id) return
      setCursors((prev) => ({
        ...prev,
        [data.id]: {
          ...data,
          lastUpdate: Date.now(),
        },
      }))
    },
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setCursors((prev) => {
        const next = { ...prev }
        let changed = false
        Object.keys(next).forEach((id) => {
          if (now - next[id].lastUpdate > 5000) {
            delete next[id]
            changed = true
          }
        })
        return changed ? next : prev
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let lastSend = 0
    const throttle = 50 // ms

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - lastSend < throttle) return

      if (client?.id) {
        send({
          id: client.id,
          name: myName,
          x: e.clientX,
          y: e.clientY,
          lastUpdate: now,
        })
        lastSend = now
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [client?.id, send, myName])

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: '50px',
          right: '10px',
          color: '#666',
          fontSize: '12px',
          pointerEvents: 'none',
        }}
      >
        Your name: <b>{myName}</b>
      </div>
      {Object.values(cursors).map((cursor) => (
        <div
          key={cursor.id}
          style={{
            position: 'fixed',
            left: cursor.x,
            top: cursor.y,
            width: '12px',
            height: '12px',
            backgroundColor:
              COLORS[
                Math.abs(
                  cursor.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0),
                ) % COLORS.length
              ],
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 9999,
            transition: 'all 0.05s linear',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              marginTop: '15px',
              padding: '2px 6px',
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: 'white',
              borderRadius: '4px',
              fontSize: '10px',
              whiteSpace: 'nowrap',
            }}
          >
            {cursor.name}
          </div>
        </div>
      ))}
    </>
  )
}
