
import { Drop } from "../types";

export const generateHypeStory = async (dropName: string, chefName: string, category: string) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return `This exclusive ${dropName} by ${chefName} defines the ${category} game. Crafted with passion and available for a limited time only.`;
};

export const generateInfluencerHype = async (dropName: string, userName: string) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return `I just tried ${dropName} and I'm speechless. ${userName} highly recommends this!`;
};

export const generateCreatorAssistance = async (dropName: string, menuSummary: string) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return "Allergens: Please check with staff.\nTips: Best enjoyed immediately upon pickup.";
};

export const simulateSubmissionEmail = async (dropData: Partial<Drop>) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return "Submission received! We are reviewing your drop now.";
};
