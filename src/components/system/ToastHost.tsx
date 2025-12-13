import { Toast, ToastContainer } from 'react-bootstrap'
import { useToastStore } from '@/lib/toastStore'

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const remove = useToastStore((s) => s.remove)

  return (
    <ToastContainer position="top-end" className="p-3" style={{ zIndex: 2000 }}>
      {toasts.map((t) => {
        const bg =
          t.tone === 'success'
            ? 'success'
            : t.tone === 'error'
              ? 'danger'
              : 'primary'
        return (
          <Toast
            key={t.id}
            onClose={() => remove(t.id)}
            delay={3500}
            autohide
            bg={bg}
          >
            <Toast.Header closeButton>
              <strong className="me-auto">{t.title}</strong>
            </Toast.Header>
            {t.message ? (
              <Toast.Body className="text-white">{t.message}</Toast.Body>
            ) : null}
          </Toast>
        )
      })}
    </ToastContainer>
  )
}


