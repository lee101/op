{ self }:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.programs.op;
in
{
  options.programs.op = {
    enable = lib.mkEnableOption "OP coding agent";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      defaultText = lib.literalExpression "inputs.op.packages.${pkgs.stdenv.hostPlatform.system}.default";
      description = "OP package to install system-wide.";
    };
  };

  config = lib.mkIf cfg.enable {
    environment.systemPackages = [ cfg.package ];
  };
}
