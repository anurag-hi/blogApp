import { useParams } from "react-router-dom";
import InPageNavigation from "../components/inpage-navigation.component";

const SearchPage = ()=>{

    let { query } = useParams()

    return (

        <section className="h-cover flex justify-center gap-10">

            <div className="w-full">
                <InPageNavigation routes={[`Search Results from "${query}"`]} >

                    <>
                    

                    </>

                </InPageNavigation>
            </div>

        </section>

    )
}

export default SearchPage;