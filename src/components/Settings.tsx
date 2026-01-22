import { useState, useEffect } from "react"
import "../styles/Settings.css"

export function FontSizeSlider() {
    const [fontSize, setFontSize] = useState(16)

    useEffect(() => {
        const saved = localStorage.getItem("font-size")
        if (saved) {
            setFontSize(Number(saved))
            document.documentElement.style.setProperty("--font-base", `${saved}px`)
        }
    }, [])
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const size = Number(e.target.value)
        setFontSize(size)

        document.documentElement.style.setProperty(
            "--font-base",
            `${size}px`
        )
        localStorage.setItem("font-size", size.toString())
    }

    return (
        <div className="settings-page">
            <div className="font-size-control">
                <label htmlFor="fontSlider">Font size: {fontSize}px  </label>
            </div>
            <div className="slider-container">
                <input
                    id="fontSlider"
                    type="range"
                    min="12"
                    max="20"
                    value={fontSize}
                    onChange={handleChange}
                />
            </div>
        </div>
    )
}