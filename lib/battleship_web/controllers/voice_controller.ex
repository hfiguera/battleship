defmodule BattleshipWeb.VoiceController do
  use BattleshipWeb, :controller

  def session(conn, _params) do
    case Battleship.MaestroVoice.session() do
      {:ok, payload} ->
        json(conn, payload)

      {:error, _reason} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{error: "Maestro voice is unavailable"})
    end
  end
end
