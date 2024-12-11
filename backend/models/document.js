import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["txt", "pdf", "docx", "rtf", "html", "xml", "json", "csv", "md", "epub", "odt", "pptx", "tsv", "yaml", "log"],
      required: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.models.document || mongoose.model("document", documentSchema);
