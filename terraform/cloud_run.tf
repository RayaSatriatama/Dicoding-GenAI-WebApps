# Backend Service
resource "google_cloud_run_v2_service" "backend" {
  name     = "dicoding-genai-backend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      # Placeholder image path - User must build & push this first
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.name}/backend:latest"
      
      ports {
        container_port = 3000
      }

      env {
        name  = "PORT"
        value = "3000"
      }
      env {
        name  = "MONGO"
        value = var.mongodb_uri
      }
      env {
        name  = "CLIENT_URL"
        value = "*" # Or the specific frontend URL after first apply
      }
      env {
        name  = "IMAGE_KIT_ENDPOINT"
        value = var.image_kit_endpoint
      }
      env {
        name  = "IMAGE_KIT_PUBLIC_KEY"
        value = var.image_kit_public_key
      }
      env {
        name  = "IMAGE_KIT_PRIVATE_KEY"
        value = var.image_kit_private_key
      }
      env {
        name  = "CLERK_PUBLISHABLE_KEY"
        value = var.clerk_publishable_key
      }
      env {
        name  = "CLERK_SECRET_KEY"
        value = var.clerk_secret_key
      }
      env {
        name  = "UPLOAD_DIR"
        value = "/tmp" # Cloud Run uses memory for filesystem
      }
    }
    
    vpc_access{
      connector = ""
      egress = "ALL_TRAFFIC"
    }
  }
}


# Frontend Service
resource "google_cloud_run_v2_service" "frontend" {
  name     = "dicoding-genai-frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
       # Placeholder image path - User must build & push this first
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.name}/frontend:latest"

      ports {
        container_port = 5173
      }

      env {
        name  = "VITE_API_URL"
        value = google_cloud_run_v2_service.backend.uri
      }
      env {
        name  = "VITE_CLERK_PUBLISHABLE_KEY"
        value = var.clerk_publishable_key
      }
      env {
        name  = "VITE_IMAGE_KIT_ENDPOINT"
        value = var.image_kit_endpoint
      }
      env {
        name  = "VITE_IMAGE_KIT_PUBLIC_KEY"
        value = var.image_kit_public_key
      }
    }
  }
  
  depends_on = [google_cloud_run_v2_service.backend]
}

# Public Access Policies
resource "google_cloud_run_service_iam_binding" "backend_public" {
  location = google_cloud_run_v2_service.backend.location
  service  = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  members = [
    "allUsers"
  ]
}

resource "google_cloud_run_service_iam_binding" "frontend_public" {
  location = google_cloud_run_v2_service.frontend.location
  service  = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  members = [
    "allUsers"
  ]
}
