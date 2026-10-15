defmodule BattleshipWeb.Router do
  use BattleshipWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {BattleshipWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", BattleshipWeb do
    pipe_through :browser

    live "/", BoardLive
  end

  scope "/api", BattleshipWeb do
    pipe_through :api

    post "/games/demo/player-shot", ShotController, :player_shot
    post "/games/demo/opponent-shot", ShotController, :opponent_shot
    get "/voice/session", VoiceController, :session
  end
end
