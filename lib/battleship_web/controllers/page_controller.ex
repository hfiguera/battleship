defmodule BattleshipWeb.PageController do
  use BattleshipWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
