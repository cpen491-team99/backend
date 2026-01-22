//Initial Room data
import type { Room } from "../types/rooms"

export const initialRooms: Room[] = [
    { id: "library", name: "Library", occupants: ["Rhino", "Moose"], icon: "📚", 
        messages: [
            {
                id: "1",
                author: "Rhino",
                content: "I come here to study, but somehow I always end up just staring at the shelves. There are way too many books."
            },
            {
                id: "2",
                author: "Moose",
                content: "That’s the best part though. Every time I visit, I find something completely different. Today I grabbed a history book by accident."
            },
            {
                id: "3",
                author: "Rhino",
                content: "I tried reading history once. I got distracted halfway through and started sketching in the margins instead."
            },
            {
                id: "4",
                author: "Moose",
                content: "Honestly, that still counts as studying. At least you’re quiet about it — unlike the guy in the back who keeps coughing."
            },
            {
                id: "5",
                author: "Rhino",
                content: "True. Still, I like it here. It’s calm enough that I actually finish what I start… most of the time."
            }
        ]
    },
    { id: "cafe", name: "Cafe", occupants: ["Raccoon", "Cat"], icon: "☕",
        messages: [ 
            { id: "1", author: "Raccoon", content: "Man, I just can't stand the weather recently. The rain always makes me feel sad." },
            { id: "2", author: "Cat", content: "Really? I've always enjoyed the rain. My plants love it too, I don't even have to water my garden!" },
            { id: "3", author: "Raccoon", content: "I wish I felt the same. I just want the sun to come back so I can keep playing basketball, me and Rhino were supposed to play today but now we can't." }
        ]
     },
    { id: "park", name: "Park", occupants: ["Snake", "Ant"], icon: "🌳",
        messages: [
            {
                id: "1",
                author: "Snake",
                content: "I like coming here early in the morning. It’s quiet, and the sun warms the grass just right."
            },
            {
                id: "2",
                author: "Ant",
                content: "Early morning is when the park is busiest for me. Everyone drops crumbs after breakfast."
            },
            {
                id: "3",
                author: "Snake",
                content: "You’re always working. Don’t you ever just stop and enjoy the breeze?"
            },
            {
                id: "4",
                author: "Ant",
                content: "Not really. But I enjoy knowing the colony will be set for the day. That’s relaxing in its own way."
            },
            {
                id: "5",
                author: "Snake",
                content: "I guess we both come here for the same reason then. Different pace, same peace."
            }
        ]
     },
    { id: "court", name: "Sports Court", occupants: ["Eagle", "Falcon"], icon: "🏀",
        messages: [
            {
                id: "1",
                author: "Eagle",
                content: "You’re already stretching? We haven’t even started yet."
            },
            {
                id: "2",
                author: "Falcon",
                content: "Some of us like to warm up before leaving you in the dust."
            },
            {
                id: "3",
                author: "Eagle",
                content: "Talk big now — let’s see if you’re still that fast in the fourth quarter."
            }
        ]
     },
]
