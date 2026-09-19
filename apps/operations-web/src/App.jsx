import { Overview } from "./components/Overview";
import { ListingReview } from "./components/ListingReview";
import { ReturnReview } from "./components/ReturnReview";
import "./styles/dashboard.css";

export default function App() {
 return (
 <main className="dashboard">
 <h1>Trust Operations Center</h1>
 <Overview />
 <ListingReview />
 <ReturnReview />
 </main>
 );
}
