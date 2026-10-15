defmodule BattleshipWeb.ShotController do
  use BattleshipWeb, :controller

  def player_shot(conn, params) do
    raw = params["coordinate"] || params["square"] || ""
    json(conn, Battleship.Game.player_shot(raw))
  end

  def opponent_shot(conn, _params) do
    json(conn, Battleship.Game.opponent_shot())
  end
end
