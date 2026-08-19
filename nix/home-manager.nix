{ self }:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.programs.op;
  yaml = pkgs.formats.yaml { };
in
{
  options.programs.op = {
    enable = lib.mkEnableOption "OP coding agent";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      defaultText = lib.literalExpression "inputs.op.packages.${pkgs.stdenv.hostPlatform.system}.default";
      description = "OP package to install.";
    };

    settings = lib.mkOption {
      type = lib.types.nullOr yaml.type;
      default = null;
      description = ''
        Settings written declaratively to {file}`~/.op/agent/config.yml`.
        The file is a read-only store symlink: changes made from inside OP
        (`/settings`, onboarding) replace it but revert on the next
        `home-manager switch`.
      '';
      example = {
        theme.dark = "titanium";
        startup.quiet = true;
      };
    };
  };

  config = lib.mkIf cfg.enable {
    home.packages = [ cfg.package ];
    home.file.".op/agent/config.yml" = lib.mkIf (cfg.settings != null) {
      source = yaml.generate "op-config.yml" cfg.settings;
    };
  };
}
