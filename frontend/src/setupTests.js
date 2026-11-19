// Jest setup (react-scripts loads this automatically).
import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

// jsdom in Jest 27 lacks these Web APIs that react-router 7 uses.
if (typeof global.TextEncoder === "undefined") global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === "undefined") global.TextDecoder = TextDecoder;
