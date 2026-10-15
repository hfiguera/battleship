defmodule BattleshipWeb.PageControllerTest do
  use BattleshipWeb.ConnCase

  test "GET / renders the board", %{conn: conn} do
    html = conn |> get(~p"/") |> html_response(200)
    assert html =~ "Battleship"
    assert html =~ "id=\"board\""
    assert html =~ "id=\"call\""
    assert html =~ "id=\"admiral-input\""
    assert html =~ "id=\"admiral-fleet\""
    assert html =~ "Show fleet"
  end

  test "voice session returns softphone credentials", %{conn: conn} do
    Application.put_env(:battleship, :maestro_client, fn ->
      {:ok,
       %{
         token: "ticket",
         agent_uuid: "agent",
         socket_url: "http://127.0.0.1:4000/voice_socket"
       }}
    end)

    on_exit(fn -> Application.delete_env(:battleship, :maestro_client) end)

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> get("/api/voice/session")

    assert %{
             "token" => "ticket",
             "agent_uuid" => "agent",
             "socket_url" => "http://127.0.0.1:4000/voice_socket"
           } = json_response(conn, 200)
  end

  test "a player shot returns a spoken result", %{conn: conn} do
    Battleship.Game.reset()

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("content-type", "application/json")
      |> post("/api/games/demo/player-shot", Jason.encode!(%{coordinate: "B7"}))

    assert %{"spoken" => spoken, "coordinate" => "B7"} = json_response(conn, 200)
    assert spoken =~ "B7"
  end
end
