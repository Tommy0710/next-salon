import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#fcf3f3',
                    100: '#f7e3e3',
                    200: '#f0cece',
                    300: '#e3adad',
                    400: '#d08282',
                    500: '#ba5c5c',
                    600: '#a34040',
                    700: '#893131',
                    800: '#732a2a',
                    900: '#741111', // primary color
                    950: '#3e0606',
                },
                secondary: colors.slate, // secondary color
            },
        },
    },
    plugins: [],
};
export default config;