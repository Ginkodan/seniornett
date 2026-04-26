import { loadAudioAction } from "../actions/audio";
import { AudioScreen } from "../../components/audio-screen.jsx";

export default function AudioPage() {
  return <AudioScreen loadAudioAction={loadAudioAction} />;
}
