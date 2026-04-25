import { loadVideoAction } from "../actions/video";
import { VideoScreen } from "../../components/video-screen.jsx";

export default function VideoPage() {
  return <VideoScreen loadVideoAction={loadVideoAction} />;
}
