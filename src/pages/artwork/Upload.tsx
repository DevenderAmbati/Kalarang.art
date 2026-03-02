import React from 'react';
import Layout from '../../components/Layout/Layout';
import CreateArtwork from '../../components/Forms/CreateArtwork';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../services/authService';

const Upload: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      // Wait for auth state to settle, then navigate
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 400);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <Layout onLogout={handleLogout} pageTitle="Upload Artwork">
      <CreateArtwork />
    </Layout>
  );
};

export default Upload;