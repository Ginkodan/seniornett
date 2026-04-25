import { fetchWeatherAction, searchLocationsAction } from "../actions/weather";
import { WeatherScreen } from "../../components/weather-screen.jsx";

export default function WetterPage() {
  return (
    <WeatherScreen
      fetchWeatherAction={fetchWeatherAction}
      searchLocationsAction={searchLocationsAction}
    />
  );
}
