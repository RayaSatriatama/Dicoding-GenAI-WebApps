import fs from 'fs';
import path from 'path';
import Document from '../models/document.js';

const fileDelete = async (req, res, next) => {
  const { userId, title } = req.params;

  try {
    console.log(`Attempting to delete document for userId: ${userId}, title: ${title}`);

    // Find the document by userId and title
    const document = await Document.findOne({ userId, title });

    if (!document) {
      console.log("Document not found");
      return res.status(404).json({ message: 'Document not found' });
    }

    // Construct the file path
    const filePath = path.join('uploads', `${document._id}-${title}`);
    console.log(`File path to delete: ${filePath}`);

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Delete the file
      fs.unlinkSync(filePath);
      console.log("File deleted successfully");
    } else {
      console.log("File not found on server");
      return res.status(404).json({ message: 'File not found on server' });
    }

    // Remove the document from the database
    await Document.deleteOne({ _id: document._id });
    console.log("Document deleted from database");

    res.status(200).json({ message: 'File and document deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'An error occurred while deleting the file' });
  }
};

export default fileDelete;
