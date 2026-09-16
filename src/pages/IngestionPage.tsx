import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

/**
 * Ingestion is merged into Dashboard notes library.
 * Route `/ingestion` redirects to `/dashboard#notes`.
 */
export default function IngestionPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate("/dashboard#notes", { replace: true })
    setTimeout(() => {
      const el = document.getElementById("notes")
      if (el) {
        el.scrollIntoView({ behavior: "smooth" })
      }
    }, 50)
  }, [navigate])

  return null
}
