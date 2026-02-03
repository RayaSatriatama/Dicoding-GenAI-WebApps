variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region (e.g., asia-southeast2)"
  type        = string
  default     = "asia-southeast2"
}

variable "mongodb_uri" {
  description = "MongoDB Connection URI (e.g., MongoDB Atlas)"
  type        = string
  sensitive   = true
}

variable "clerk_publishable_key" {
  type = string
}

variable "clerk_secret_key" {
  type      = string
  sensitive = true
}

variable "image_kit_endpoint" {
  type = string
}

variable "image_kit_public_key" {
  type = string
}

variable "image_kit_private_key" {
  type      = string
  sensitive = true
}
