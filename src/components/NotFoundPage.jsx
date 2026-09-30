import { Link } from "react-router-dom";
import "./NotFoundPage.css";

function NotFoundPage() {
  return (
    <main className="content notFoundPage">
      <div className="notFoundCard">
        <p className="notFoundCode">404</p>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist or has moved.</p>
        <Link to="/">Back to the Pokédex</Link>
      </div>
    </main>
  );
}

export default NotFoundPage;
