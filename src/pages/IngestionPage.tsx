import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

/**
 * Ingestion is now merged directly into the single-user Dashboard (§9.1 / §9.3).
 * Route `/ingestion` redirects seamlessly to `/dashboard#corpus`.
 */
export default function IngestionPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate("/dashboard#corpus", { replace: true })
    setTimeout(() => {
      const el = document.getElementById("corpus")
      if (el) {
        el.scrollIntoView({ behavior: "smooth" })
      }
    }, 50)
  }, [navigate])

  return null
}
