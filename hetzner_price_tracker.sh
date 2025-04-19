#!/bin/bash

case "$1" in
  config)
    case "$2" in
      reset)
        rm -f ./discordjs/config.json
        rm -f ./express/config.json
        echo "Config reset"
        ;;
      express)
        case "$3" in
          reset)
            rm -f ./express/config.json
            echo "Express config reset"
            ;;
          *)
            read -p "Postgres host : " postgres_host
            read -p "Postgres port : " postgres_port
            read -p "Postgres database name : " postgres_db
            read -p "Postgres user : " postgres_user
            read -p "Postgres password : " postgres_password
            mkdir -p ./express
            jq -n \
              --arg pg_user "$postgres_user" \
              --arg pg_password "$postgres_password" \
              --arg pg_host "$postgres_host" \
              --arg pg_port "$postgres_port" \
              --arg pg_db "$postgres_db" \
              '{
                postgres_user: $pg_user,
                postgres_password: $pg_password,
                postgres_host: $pg_host,
                postgres_port: $pg_port,
                postgres_db: $pg_db
              }' > ./express/config.json

            echo "Express config saved."
            ;;
        esac
        ;;
      discordjs)
        case "$3" in
          reset)
            rm -f ./discordjs/config.json
            echo "DiscordJS config reset"
            ;;
          *)
            echo '# MONGO Config'
            read -p "Mongo host : " mongo_host
            read -p "Mongo port : " mongo_port
            read -p "Mongo database : " mongo_db
            echo "# BACKEND"
            read -p "express address http://host:port : " backend_address
            echo "# BOT config :"
            read -p "Token : " token
            read -p "Client Id : " clientId
            read -p "Guild Id : " guildId
            mkdir -p ./discordjs
            jq -n \
              --arg mg_host "$mongo_host" \
              --arg mg_port "$mongo_port" \
              --arg mg_db "$mongo_db" \
              --arg back_url "$backend_address" \
              --arg tkn "$token" \
              --arg cId "$clientId" \
              --arg gId "$guildId" \
              '{
                mongo_host: $mg_host,
                mongo_port: $mg_port,
                mongo_db: $mg_db,
                backend_address: $back_url,
                token: $tkn,
                clientId: $cId,
                guildId: $gId
              }' > ./discordjs/config.json

            echo "DiscordJS config saved."
            ;;
        esac
        ;;
      *)
        echo "Usage : $0 config {discordjs|express|reset}"
        exit 1
        ;;
    esac
    ;;
  update)
    # supprimer tout les fichiers sauf /config
    curl -L -o hetzner_price_tracker.zip https://github.com/St4lV/hetzner-price-tracker/archive/refs/heads/main.zip
    unzip hetzner_price_tracker.zip -d ../hetzner_price_tracker/

    echo "Updating..."
    ;;
  start)
    echo "Starting..."
    ;;
  stop)
    echo "Stopping..."
    ;;
  install)
    echo "Installing HetznerServicePriceTracker.."

    hetzner_price_tracker.sh config express
    hetzner_price_tracker.sh config discordjs
    hetzner_price_tracker.sh start
    ;;
  *)
    echo "Usage : $0 {config|start|stop|install|update}"
    exit 1
    ;;
esac
