#!/usr/bin/env node

import { Command } from "commander";
import { registerCommands } from "./commands/index.js";

const program = new Command();

program.name("legal-ai").version("1.0.0").description("Legal AI CLI tool");

registerCommands(program);

program.parse(process.argv);
