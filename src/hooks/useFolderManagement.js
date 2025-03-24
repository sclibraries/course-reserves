// src/hooks/useFolderManagement.js
import { useState, useEffect } from 'react';
import { config } from '../config';

const API_BASE = config.api.urls.courseReserves;
const getAuthToken = config.api.getAuthToken;

export const useFolderManagement = () => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to fetch folders from the backend
  const fetchFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const FOLDER_ENDPOINT = `${API_BASE}${config.api.endpoints.folder.base}`;
      const response = await fetch(FOLDER_ENDPOINT, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${getAuthToken()}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch folders');
      }
      const data = await response.json();
      setFolders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Call fetchFolders on mount
  useEffect(() => {
    fetchFolders();
  }, []);

  // Function to create a new folder
  const createFolder = async (folderData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/folder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(folderData),
      });
      if (!response.ok) {
        throw new Error('Failed to create folder');
      }
      const newFolder = await response.json();
      // Refresh folder list
      await fetchFolders();
      return newFolder;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { folders, loading, error, fetchFolders, createFolder };
};
