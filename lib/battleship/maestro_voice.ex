defmodule Battleship.MaestroVoice do
  @moduledoc """
  Credentials for a browser softphone that joins Maestro's voice socket.

  The browser cannot mint Maestro's socket credential. This module logs in
  with the CLI email/password API and looks up the battleship agent, then
  hands the bearer token to the page. `VoiceSocket` accepts that token.
  """

  def session do
    case Application.get_env(:battleship, :maestro_client) do
      fun when is_function(fun, 0) -> fun.()
      _ -> fetch_session()
    end
  end

  defp fetch_session do
    with {:ok, token} <- login(),
         {:ok, uuid} <- agent_uuid(token) do
      {:ok, %{token: token, agent_uuid: uuid, socket_url: socket_url()}}
    end
  end

  defp login do
    body = Jason.encode!(%{email: setting(:email), password: setting(:password)})

    case request(:post, base_url() <> "/api/cli/v1/login", body, []) do
      {:ok, 200, %{"token" => token}} when is_binary(token) -> {:ok, token}
      _ -> {:error, :login_failed}
    end
  end

  defp agent_uuid(token) do
    headers = [{"authorization", "Bearer " <> token}]

    case request(:get, base_url() <> "/api/bridge/v1/agents", nil, headers) do
      {:ok, 200, %{"data" => agents}} when is_list(agents) ->
        slug = setting(:agent_slug)

        case Enum.find(agents, &(&1["slug"] == slug)) do
          %{"uuid" => uuid} when is_binary(uuid) -> {:ok, uuid}
          _ -> {:error, :agent_not_found}
        end

      _ ->
        {:error, :agent_lookup_failed}
    end
  end

  defp socket_url, do: base_url() <> "/voice_socket"

  defp base_url do
    setting(:base_url) |> to_string() |> String.trim_trailing("/")
  end

  defp setting(key) do
    env = System.get_env(env_name(key))
    configured = Application.get_env(:battleship, :maestro, []) |> Keyword.get(key)

    if is_binary(env) and env != "" do
      env
    else
      configured
    end
  end

  defp env_name(:base_url), do: "MAESTRO_URL"
  defp env_name(:email), do: "MAESTRO_EMAIL"
  defp env_name(:password), do: "MAESTRO_PASSWORD"
  defp env_name(:agent_slug), do: "MAESTRO_AGENT_SLUG"

  defp request(method, url, body, headers) do
    _ = :inets.start()
    _ = :ssl.start()

    header_list =
      Enum.map(headers, fn {key, value} ->
        {String.to_charlist(key), String.to_charlist(value)}
      end)

    http_request =
      if body do
        {String.to_charlist(url), header_list, ~c"application/json", body}
      else
        {String.to_charlist(url), header_list}
      end

    case :httpc.request(method, http_request, [{:timeout, 10_000}], body_format: :binary) do
      {:ok, {{_, status, _}, _headers, resp}} when is_binary(resp) ->
        decode(status, resp)

      {:ok, {{_, status, _}, _headers, resp}} ->
        decode(status, IO.iodata_to_binary(resp))

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp decode(status, resp) do
    case Jason.decode(resp) do
      {:ok, json} -> {:ok, status, json}
      _ -> {:ok, status, %{}}
    end
  end
end
