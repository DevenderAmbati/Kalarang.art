import React from 'react';
import Layout from '../../components/Layout/Layout';
import CreateArtwork from '../../components/Forms/CreateArtwork';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../services/authService';

interface UploadProps {
  embedded?: boolean;
}

const Upload: React.FC<UploadProps> = ({ embedded = false }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      // Wait for auth state to settle, then navigate
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 400);
    } catch {
      // Logout failed; ignore
    }
  };

  if (embedded) {
    return <CreateArtwork />;
  }

  return (
    <Layout onLogout={handleLogout} pageTitle="Upload">
      <CreateArtwork />
    </Layout>
  );
};

export default Upload;