import { useState, useEffect } from 'react'

// <img> de avatar con respaldo: si la imagen no carga (URL caída, bloqueada
// o sin red), muestra `fallback` (normalmente la inicial del nombre) en vez
// del icono de imagen rota con el texto "avatar".
//
// Por qué importa en la app Android (Capacitor): el WebView sirve la app
// desde https://localhost, así que algunas URLs de avatar (p. ej. las de
// Google) rechazan la petición por el Referer y la imagen falla, cosa que
// en la PWA no pasa. `referrerPolicy="no-referrer"` evita ese rechazo y el
// `onError` cubre cualquier otro caso.
export function AvatarImg({ src, alt = '', fallback = null, ...imgProps }) {
  const [failed, setFailed] = useState(false)

  // Si cambia la URL (el usuario sube otra foto), se vuelve a intentar.
  useEffect(() => { setFailed(false) }, [src])

  if (!src || failed) return fallback

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      {...imgProps}
    />
  )
}
