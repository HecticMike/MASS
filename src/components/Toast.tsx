import { useEffect, useState } from 'react'
import styles from './Toast.module.css'

type ToastProps = {
  message: string
}

const Toast = ({ message }: ToastProps) => {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2200)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) {
    return null
  }

  return <div className={styles.toast}>{message}</div>
}

export default Toast
