import React from "react";
import { useNavigate } from "react-router-dom";
import { ArtworkRecommendation } from "../../services/artAdvisorService";

interface Props {
  artwork: ArtworkRecommendation;
}

const ArtworkRecommendationCard: React.FC<Props> = ({ artwork }) => {
  const navigate = useNavigate();
  const imgSrc = artwork.images?.[0] || "";

  return (
    <button
      type="button"
      className="aa-artwork-card"
      onClick={() => navigate(`/card/${artwork.id}`)}
    >
      {imgSrc && <img src={imgSrc} alt={artwork.title} className="aa-artwork-card-img" />}
      <div className="aa-artwork-card-body">
        <span className="aa-artwork-card-title">{artwork.title}</span>
        <span className="aa-artwork-card-meta">₹{artwork.price?.toLocaleString("en-IN")}</span>
        <span className="aa-artwork-card-tags">
          {[artwork.category, artwork.medium].filter(Boolean).join(" · ")}
          {artwork.artistName ? ` · ${artwork.artistName}` : ""}
        </span>
      </div>
    </button>
  );
};

export default ArtworkRecommendationCard;
