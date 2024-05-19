{
  description = "flake for hacker-news-rss";

  inputs = {
    nixpkgs.url = "nixpkgs/nixos-23.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ...}@inputs:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      with pkgs; {
        packages = rec {
          hacker-news-rss-run-rss = ./runRss.sh;
          hacker-news-rss = writeShellApplication {
            name = "hacker-news-rss";
            runtimeInputs = [
              nodejs
            ];
            text = "${./runRss.sh} \"$@\"";
          };
        };
      }
    );
}
