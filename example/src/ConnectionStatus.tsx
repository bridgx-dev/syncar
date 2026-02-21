import { useSynnel } from '@synnel/react'

export const ConnectionStatus = () => {
  const { status } = useSynnel()

  const statusColors = {
    connecting: '#ffa500',
    open: '#4caf50',
    closed: '#f44336',
    closing: '#ff5722',
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        padding: '5px 10px',
        borderRadius: '15px',
        backgroundColor: statusColors[status],
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: 'white',
        }}
      />
      Synnel: {status.toUpperCase()}
    </div>
  )
}
