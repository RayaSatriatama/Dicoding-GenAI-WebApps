resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "dicoding-genai-repo"
  description   = "Docker repository for Dicoding GenAI apps"
  format        = "DOCKER"
}
